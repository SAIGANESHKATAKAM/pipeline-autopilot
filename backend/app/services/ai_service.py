import json
import google.generativeai as genai
from app.core.config import settings

genai.configure(api_key=settings.gemini_api_key)
model = genai.GenerativeModel("gemini-2.0-flash")


async def analyze_pipeline_failure(
    logs: str,
    repo_name: str,
    workflow_name: str,
    branch: str,
    commit_message: str,
) -> dict:
    """
    Send pipeline logs to Gemini and get back a structured analysis.
    Returns dict with: error_summary, root_cause, affected_files, fix_suggestions, confidence
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

    response = model.generate_content(prompt)
    text = response.text.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {
            "error_summary": "AI analysis failed to parse",
            "root_cause": text[:500],
            "error_type": "unknown",
            "affected_files": [],
            "fix_suggestions": [],
            "can_auto_fix": False,
            "overall_confidence": "low",
        }


async def generate_fix(
    file_path: str,
    file_content: str,
    error_summary: str,
    root_cause: str,
    fix_description: str,
) -> dict:
    """
    Given a file and the error context, generate a fixed version of the file.
    Returns dict with: fixed_content, explanation, changes_made
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

    response = model.generate_content(prompt)
    text = response.text.strip()

    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {
            "fixed_content": None,
            "explanation": "AI fix generation failed",
            "changes_made": [],
        }


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

    response = model.generate_content(prompt)
    return response.text.strip()
