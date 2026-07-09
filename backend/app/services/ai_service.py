import json
import httpx
from app.core.config import settings

OPENAI_RESPONSES_API = "https://api.openai.com/v1/responses"
OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions"


def _is_configured(value: str | None) -> bool:
    return bool(value and value.strip() and value != "CHANGE_ME")


async def _azure_openai_completion(prompt: str, *, expect_json: bool = False) -> str:
    required_settings = [
        settings.azure_openai_endpoint,
        settings.azure_openai_api_key,
        settings.azure_openai_deployment,
        settings.azure_openai_api_version,
    ]
    if not all(_is_configured(value) for value in required_settings):
        raise RuntimeError(
            "AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, "
            "AZURE_OPENAI_DEPLOYMENT, and AZURE_OPENAI_API_VERSION must be configured"
        )

    endpoint = settings.azure_openai_endpoint.strip().rstrip("/")
    deployment = settings.azure_openai_deployment.strip()
    path_prefix = settings.azure_openai_path_prefix.strip().strip("/")
    deployments_path = f"{path_prefix}/deployments" if path_prefix else "deployments"
    url = f"{endpoint}/{deployments_path}/{deployment}/chat/completions"
    api_key = settings.azure_openai_api_key.strip()
    headers = {
        settings.azure_openai_api_key_header.strip(): api_key,
        "api-key": api_key,
        "Ocp-Apim-Subscription-Key": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "messages": [{"role": "user", "content": prompt}],
    }
    if expect_json:
        payload["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(
            url,
            headers=headers,
            params={"api-version": settings.azure_openai_api_version.strip()},
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    return data["choices"][0]["message"]["content"].strip()


def _extract_openai_text(data: dict) -> str:
    if data.get("output_text"):
        return data["output_text"].strip()

    parts: list[str] = []
    for item in data.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text" and content.get("text"):
                parts.append(content["text"])

    return "\n".join(parts).strip()


async def _openai_completion(prompt: str, *, expect_json: bool = False) -> str:
    if not _is_configured(settings.openai_api_key):
        raise RuntimeError("OPENAI_API_KEY is not configured")

    headers = {
        "Authorization": f"Bearer {settings.openai_api_key.strip()}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.openai_model,
        "input": prompt,
    }
    if expect_json:
        payload["text"] = {"format": {"type": "json_object"}}

    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(OPENAI_RESPONSES_API, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

    text = _extract_openai_text(data)
    if not text:
        raise RuntimeError("OpenAI response did not include output text")
    return text


async def _ai_completion(prompt: str, *, expect_json: bool = False) -> str:
    if _is_configured(settings.azure_openai_endpoint) or _is_configured(settings.azure_openai_api_key):
        return await _azure_openai_completion(prompt, expect_json=expect_json)
    if _is_configured(settings.openai_api_key):
        return await _openai_completion(prompt, expect_json=expect_json)
    return await _openrouter_completion(prompt, expect_json=expect_json)


async def _openrouter_completion(prompt: str, *, expect_json: bool = False) -> str:
    if not _is_configured(settings.openrouter_api_key):
        raise RuntimeError(
            "AZURE_OPENAI_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY is not configured"
        )

    api_key = settings.openrouter_api_key.strip()
    site_url = settings.openrouter_site_url.strip()
    site_name = settings.openrouter_site_name.strip()

    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": site_url,
        "X-Title": site_name,
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
    Send pipeline logs to the configured AI provider and get back a structured analysis.
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
  "affected_files": ["all", "relevant", "file", "paths", "likely", "causing", "the", "failure"],
  "fix_suggestions": [
    {{
      "file": "path/to/file1.ext",
      "description": "What needs to be changed and why",
      "confidence": "high|medium|low"
    }},
    {{
      "file": "path/to/file2.ext",
      "description": "What needs to be changed and why",
      "confidence": "high|medium|low"
    }}
  ],
  "can_auto_fix": true,
  "overall_confidence": "high|medium|low"
}}

Important rules:
- If the build or test failure points to more than one file, include multiple entries in both affected_files and fix_suggestions.
- Do not collapse the problem to a single file unless the evidence strongly points to just one.
- Return ONLY the JSON, no markdown, no explanation."""

    text = await _ai_completion(prompt, expect_json=True)
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

    text = await _ai_completion(prompt, expect_json=True)
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

    return await _ai_completion(prompt)
