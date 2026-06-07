"""
LLM service using DeepSeek API (OpenAI-compatible) for:
  - Translation
  - Paraphrasing (same-language simplification)
  - Note extraction
"""

import logging
import re
from dataclasses import dataclass
from typing import Optional

from openai import OpenAI

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

LANGUAGE_NAMES = {
    "zh": "中文",
    "en": "English",
    "ja": "日本語",
    "ko": "한국어",
}


@dataclass
class LLMResult:
    translation: str
    paraphrase: str
    notes: str


# ---------------------------------------------------------------------------
# Client (lazy)
# ---------------------------------------------------------------------------
_client: Optional[OpenAI] = None


def is_available() -> bool:
    """Check whether the LLM service has a configured API key."""
    key = settings.llm_api_key or settings.openai_api_key
    return bool(key)


def _get_client() -> Optional[OpenAI]:
    global _client
    if _client is not None:
        return _client
    key = settings.llm_api_key or settings.openai_api_key
    if not key:
        logger.warning("No LLM API key configured — using local fallback")
        return None
    _client = OpenAI(
        api_key=key,
        base_url=settings.llm_base_url,
    )
    return _client


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """你是一位专业的同声传译助手。你将收到一段语音识别文本，需要同时完成以下三项任务，以JSON格式返回。

## 任务 1：翻译
将原文翻译成指定的目标语言。要求：
- 准确传达原文含义，不要遗漏信息
- 语言自然流畅，符合目标语言表达习惯
- 专业术语翻译准确

## 任务 2：同语言简化重述
用与原文相同的语言，将内容改写成更简单易懂的表达。要求：
- 使用更简单的词汇和句式
- 保留所有关键信息
- 对于英语，将复杂词汇（如 utilize → use, implement → put in place）替换为简单词
- 长句拆分为短句
- 保持自然流畅

## 任务 3：口译笔记
提取关键信息生成符号化笔记。要求：
- 使用符号和缩写（↑ 增长, ↓ 下降, → 导致, # 数字, ⏰ 时间/里程碑）
- 提取专有名词、数字、关键结论
- 每行一个要点
- 简洁，不要完整句子

## 输出格式

你必须严格以以下JSON格式返回（不要包含markdown代码块标记）：

```json
{
  "translation": "...",
  "paraphrase": "...",
  "notes": "..."
}
```"""


def process(
    text: str,
    source_language: str = "zh",
    target_language: str = "en",
) -> LLMResult:
    """
    Process a segment of recognised speech through the LLM pipeline.

    Args:
        text: The recognised text to process.
        source_language: Source language code (zh/en/ja).
        target_language: Target language code for translation.

    Returns:
        LLMResult with translation, paraphrase, and notes.
    """
    client = _get_client()
    if not client:
        return _fallback(text, target_language)

    src_name = LANGUAGE_NAMES.get(source_language, source_language)
    tgt_name = LANGUAGE_NAMES.get(target_language, target_language)

    user_prompt = (
        f"源语言: {src_name}\n"
        f"目标语言: {tgt_name}\n"
        f"原文: {text}\n\n"
        f"请返回JSON，包含翻译成{tgt_name}的translation、同语言简化重述paraphrase、符号化笔记notes。"
    )

    try:
        resp = client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.1,
            max_tokens=1024,
            response_format={"type": "json_object"},
        )
        content = resp.choices[0].message.content.strip()
        return _parse_json_response(content, text, target_language)
    except Exception as e:
        logger.error("LLM API error: %s", e)
        return _fallback(text, target_language)


def _parse_json_response(content: str, original: str, target_lang: str) -> LLMResult:
    """Parse the LLM JSON response with fallback."""
    import json as json_mod

    # Strip code fences if present
    cleaned = re.sub(r"^```(?:json)?\s*", "", content.strip())
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        data = json_mod.loads(cleaned)
        return LLMResult(
            translation=data.get("translation", original),
            paraphrase=data.get("paraphrase", original),
            notes=data.get("notes", ""),
        )
    except json_mod.JSONDecodeError:
        logger.warning("Failed to parse LLM JSON, using fallback")
        return _fallback(original, target_lang)


def _fallback(text: str, target_lang: str) -> LLMResult:
    """Fallback when LLM is unavailable."""
    tgt = LANGUAGE_NAMES.get(target_lang, target_lang)
    return LLMResult(
        translation=f"[{tgt}] {text}",
        paraphrase=_simple_simplify(text),
        notes=_simple_notes(text),
    )


# ---------------------------------------------------------------------------
# Simple fallback paraphrase & notes (no API needed)
# ---------------------------------------------------------------------------
_SIMPLIFY_MAP = [
    (r"\b(utilize|utilises|utilized|utilizing)\b", "use"),
    (r"\b(implement|implements|implemented|implementing)\b", "put in place"),
    (r"\b(subsequently|subsequent)\b", "next"),
    (r"\bprior to\b", "before"),
    (r"\b(demonstrate|demonstrates|demonstrated|demonstrating)\b", "show"),
    (r"\bsufficient\b", "enough"),
    (r"\bapproximately\b", "about"),
    (r"\bnevertheless\b", "but"),
    (r"\b(commence|commences|commenced|commencing)\b", "start"),
    (r"\b(terminate|terminates|terminated|terminating)\b", "end"),
    (r"\b(obtain|obtains|obtained|obtaining)\b", "get"),
    (r"\b(purchase|purchases|purchased|purchasing)\b", "buy"),
    (r"\bassistance\b", "help"),
    (r"\bregarding\b", "about"),
    (r"\badditional\b", "more"),
    (r"\b(significant|significantly)\b", "important"),
    (r"\bnumerous\b", "many"),
    (r"\bfacilitate\b", "help with"),
    (r"\bare able to\b", "can"),
    (r"\bis able to\b", "can"),
    (r"\bin order to\b", "to"),
    (r"\bdue to the fact that\b", "because"),
    (r"\bat this point in time\b", "now"),
    (r"\bin the event that\b", "if"),
    (r"\bwith the exception of\b", "except"),
    (r"\ba multitude of\b", "many"),
    (r"\ba majority of\b", "most"),
]

_NOTE_KEYWORDS = [
    (r"(growth|increase|rise|grew|expand)", "↑ 增长"),
    (r"(decrease|decline|drop|fell|reduce)", "↓ 下降"),
    (r"(milestone|deadline|schedule)", "⏰ 里程碑"),
    (r"(percent|%)", "📊 数据"),
    (r"(Singapore|SG|sg)", "🇸🇬 新加坡"),
    (r"(Vietnam|VN|vn)", "🇻🇳 越南"),
    (r"(China|CN|cn|Beijing|beijing)", "🇨🇳 中国"),
    (r"(US|USA|United States|America)", "🇺🇸 美国"),
    (r"(Japan|JP|Tokyo|tokyo)", "🇯🇵 日本"),
]


def _simple_simplify(text: str) -> str:
    s = text
    for pattern, replacement in _SIMPLIFY_MAP:
        s = re.sub(pattern, replacement, s, flags=re.IGNORECASE)
    return s


def _simple_notes(text: str) -> str:
    lines = []
    # Extract capitalized words (potential proper nouns)
    keywords = re.findall(r"\b[A-Z][a-z]{2,}\b", text)
    if keywords:
        unique = list(dict.fromkeys(keywords))
        lines.append("→ " + ", ".join(unique))
    # Extract numbers
    nums = re.findall(r"\b\d+[\d,.]*\b", text)
    if nums:
        lines.append("  # " + ", ".join(nums))
    # Keyword triggers
    for pattern, emoji in _NOTE_KEYWORDS:
        if re.search(pattern, text, re.IGNORECASE):
            lines.append("  " + emoji)
    return "\n".join(lines)
