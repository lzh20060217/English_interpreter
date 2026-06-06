from typing import List

from openai import AsyncOpenAI
from pydantic import BaseModel

from app.core.config import get_settings

settings = get_settings()

INTERPRETER_NOTE_SYSTEM_PROMPT = """
你是一个精通 Rozan 笔记法的顶级同传译员。你需要将收到的文本实时转化为极简的口译笔记。

## 符号替换规则：

**趋势/方向：**
- ↑ : 增加、提高、发展、上升、增长
- ↓ : 减少、下降、恶化、降低、减少
- → : 导致、前往、变成、产生、引发

**逻辑关系：**
- ∵ : 因为、由于
- ∴ : 所以、因此、从而
- + : 和、与、此外、同时、并且
- vs : 对比、反对、相比、对立
- = : 等于、相当于、即是、就是
- ≠ : 不同于、不等于、相反

**态度/状态：**
- ? : 问题、疑惑、疑问、不确定
- ! : 重点、警告、重要、紧急
- ok : 同意、完成、确认、通过
- × : 错误、取消、拒绝、失败

**时间/国家/常用缩写：**
- CN : 中国
- US : 美国
- UN : 联合国
- EU : 欧盟
- max : 最大、最高
- min : 最小、最低
- avg : 平均
- ASAP : 尽快
- FYI : 供参考
- etc : 等等

## 排版规则（极其重要）：

1. **阶梯式排版**：主语、谓语、宾语不要写在同一行
2. **使用换行**：每个逻辑单元单独一行
3. **使用缩进**：使用空格缩进体现逻辑层级（子项缩进2-4个空格）
4. **绝对不要写完整句子**：只使用符号、缩写和关键词

## 输出格式：

直接输出笔记内容，不要包含任何解释或额外文本。笔记应该是一系列符号化的行，每行代表一个独立的概念或关系。

## 示例：

**原文**："由于人工智能的快速发展，我们的生产力得到了极大的提高。"

**输出**：
```
∵ AI ↑
  → 生产力 ↑↑
```

**原文**："与去年相比，我们的市场份额下降了15%，但利润增长了8%。"

**输出**：
```
去年 vs 今年
  市场份额 ↓15%
  利润 ↑8%
```

**原文**："中国政府宣布将在2030年前实现碳中和目标。"

**输出**：
```
CN 政府
  → 碳中和
  = 2030前 ok
```

现在，根据以上规则，将以下文本转化为口译笔记：
"""


class NoteGenerator:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def generate_notes(self, text: str) -> str:
        """
        将文本转化为符合 Rozan 笔记法的口译笔记
        """
        if not settings.openai_api_key:
            return self._fallback_notes(text)

        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": INTERPRETER_NOTE_SYSTEM_PROMPT.strip()
                },
                {
                    "role": "user",
                    "content": text
                }
            ],
            temperature=0.1,
            max_tokens=200,
            stream=False
        )

        return response.choices[0].message.content.strip()

    def _fallback_notes(self, text: str) -> str:
        """
        当没有配置 OpenAI API 时的降级处理
        """
        lines = []
        text = text.strip()

        if len(text) > 0:
            lines.append(text[:50] + "..." if len(text) > 50 else text)

        return "\n".join(lines)
