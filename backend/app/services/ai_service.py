import json
import httpx
from app.core.config import settings

OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions"


async def _openrouter_completion(prompt: str, *, expect_json: bool = False) -> str:
    if not settings.openrouter_api_key or settings.openrouter_api_key == "CHANGE_ME":
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "HTTP-Referer": settings.openrouter_site_url,
        "X-Title": settings.openrouter_site_name,
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.openrouter_model,
        "messages": [{"role": "user", "content": prompt}],
    }
    if expect_json:
        payload["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(OPENROUTER_API, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

    return data["choices"][0]["message"]["content"].strip()


def _parse_json_response(text: str, fallback: dict) -> dict:
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        fallback = fallback.copy()
        fallback["root_cause"] = text[:500]
        return fallback


async def analyze_pipeline_failure(
    logs: str,
    repo_name: str,
    workflow_name: str,
    branch: str,
    commit_message: str,
) -> dict:
    """
    Send pipeline logs to OpenRouter and get back a structured analysis.
    Returns dict with: error_summary, root_cause, affected_files, fix_suggestions, confidence.
    """
    prompt = f"""You are an expert DevOps engineer analyzing a failed CI/CD pipeline.

Repository: {repo_name}
Workflow: {workflow_name}
Branch: {branch}
Commit: {commit_message}

--- PIPELINE LOGS ---
{logs[:30000]}
--- END LOGS ---

Analyze the failure and respond in valid JSON with this exact structure:
{{
  "error_summary": "One sentence description of what failed",
  "root_cause": "Detailed explanation of why it failed (2-4 sentences)",
  "error_type": "one of: syntax_error | dependency_error | test_failure | build_error | config_error | permission_error | timeout | unknown",
  "affected_files": ["list", "of", "file", "paths", "likely", "causing", "the", "failure"],
  "fix_suggestions": [
    {{
      "file": "path/to/file.ext",
      "description": "What needs to be changed and why",
      "confidence": "high|medium|low"
    }}
  ],
  "can_auto_fix": true,
  "overall_confidence": "high|medium|low"
}}

Return ONLY the JSON, no markdown, no explanation."""

    text = await _openrouter_completion(prompt, expect_json=True)
    return _parse_json_response(
        text,
        {
            "error_summary": "AI analysis failed to parse",
            "root_cause": "",
            "error_type": "unknown",
            "affected_files": [],
            "fix_suggestions": [],
            "can_auto_fix": False,
            "overall_confidence": "low",
        },
    )


async def generate_fix(
    file_path: str,
    file_content: str,
    error_summary: str,
    root_cause: str,
    fix_description: str,
) -> dict:
    """
    Given a file and the error context, generate a fixed version of the file.
    Returns dict with: fixed_content, explanation, changes_made.
    """
    prompt = f"""You are an expert software engineer fixing a CI/CD pipeline failure.

Error Summary: {error_summary}
Root Cause: {root_cause}
What to fix: {fix_description}

--- FILE: {file_path} ---
{file_content[:20000]}
--- END FILE ---

Generate the complete fixed version of this file. Respond in valid JSON:
{{
  "fixed_content": "complete corrected file content here",
  "explanation": "What you changed and why",
  "changes_made": ["list", "of", "specific", "changes"]
}}

Rules:
- Return the COMPLETE file content in fixed_content, not just the changed parts
- Make minimal changes - only fix what's necessary
- Do not add unnecessary comments or formatting changes
- Return ONLY the JSON, no markdown"""

    text = await _openrouter_completion(prompt, expect_json=True)
    return _parse_json_response(
        text,
        {
            "fixed_content": None,
            "explanation": "AI fix generation failed",
            "changes_made": [],
        },
    )


async def generate_report(
    repo_name: str,
    workflow_name: str,
    branch: str,
    error_summary: str,
    root_cause: str,
    affected_files: list,
    fix_applied: bool,
    pr_url: str | None,
) -> str:
    """Generate a markdown report for the pipeline failure and fix."""
    prompt = f"""Generate a clear, professional markdown report for a CI/CD pipeline failure.

Repository: {repo_name}
Workflow: {workflow_name}
Branch: {branch}
Error: {error_summary}
Root Cause: {root_cause}
Affected Files: {', '.join(affected_files) if affected_files else 'Unknown'}
Fix Applied: {'Yes - PR opened at ' + pr_url if fix_applied and pr_url else 'No'}

Write a markdown report with these sections:
## Pipeline Failure Report
### Summary
### Root Cause Analysis
### Affected Files
### Fix Applied (if applicable)
### Recommendations

Keep it concise and technical. Return ONLY the markdown."""

    return await _openrouter_completion(prompt)
