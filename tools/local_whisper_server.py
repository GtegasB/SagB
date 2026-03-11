import os
import tempfile
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from faster_whisper import WhisperModel

app = FastAPI(title='SagB Local Whisper', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


def resolve_model_alias(model_name: str) -> str:
    normalized = (model_name or '').strip().lower()
    aliases = {
        'whisper-1': os.getenv('LOCAL_WHISPER_DEFAULT_MODEL', 'small'),
        'tiny': 'tiny',
        'base': 'base',
        'small': 'small',
        'medium': 'medium',
        'large': 'large-v3',
        'large-v3': 'large-v3',
    }
    return aliases.get(normalized, normalized or os.getenv('LOCAL_WHISPER_DEFAULT_MODEL', 'small'))


@lru_cache(maxsize=4)
def get_model(model_name: str) -> WhisperModel:
    device = os.getenv('LOCAL_WHISPER_DEVICE', 'auto')
    compute_type = os.getenv('LOCAL_WHISPER_COMPUTE_TYPE', 'int8')
    return WhisperModel(model_name, device=device, compute_type=compute_type)


@app.get('/health')
def health():
    return {'ok': True}


@app.post('/v1/audio/transcriptions')
async def transcribe(
    file: UploadFile = File(...),
    model: str = Form('whisper-1'),
    language: str | None = Form(None),
):
    model_name = resolve_model_alias(model)

    suffix = Path(file.filename or 'audio.webm').suffix or '.webm'
    tmp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name
            content = await file.read()
            tmp.write(content)

        whisper_model = get_model(model_name)
        segments, info = whisper_model.transcribe(
            tmp_path,
            language=(language or None),
            vad_filter=True,
            beam_size=1,
        )

        text = ' '.join((seg.text or '').strip() for seg in segments).strip()
        return {
            'text': text,
            'language': getattr(info, 'language', None),
            'duration': getattr(info, 'duration', None),
            'model': model_name,
        }
    except Exception as exc:
        return JSONResponse(status_code=500, content={'error': f'local_whisper_error: {exc}'})
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass


if __name__ == '__main__':
    host = os.getenv('LOCAL_WHISPER_HOST', '127.0.0.1')
    port = int(os.getenv('LOCAL_WHISPER_PORT', '8000'))
    uvicorn.run(app, host=host, port=port, log_level='info')
