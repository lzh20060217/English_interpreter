from fastapi import APIRouter, HTTPException

from app.services.note_generator import NoteGenerator

router = APIRouter()

note_generator = NoteGenerator()


@router.post("/generate")
async def generate_notes(text: str):
    """
    根据文本生成符合 Rozan 笔记法的口译笔记
    
    :param text: 待处理的源文本
    :return: 符号化的口译笔记内容
    """
    if not text or len(text.strip()) == 0:
        raise HTTPException(status_code=400, detail="文本内容不能为空")

    try:
        notes = await note_generator.generate_notes(text)
        return {"notes": notes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"笔记生成失败: {str(e)}")
