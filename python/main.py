"""
Python IPC server for 간편변환기.
Reads line-delimited JSON from stdin, writes line-delimited JSON to stdout.
Message format: {"id": <int>, "action": <str>, ...params}
Response format: {"id": <int>, "ok": true, "data": ...} | {"id": <int>, "ok": false, "error": <str>}
"""

import sys
import io
import json

# Windows의 기본 인코딩(CP949)이 아닌 UTF-8 강제 적용
sys.stdin  = io.TextIOWrapper(sys.stdin.buffer,  encoding='utf-8')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)

from converters.image import ImageConverter
from converters.media import MediaConverter
from converters.document import DocumentConverter
from converters.data import DataConverter
from converters.pdf import PdfConverter
from converters.excel import ExcelConverter

converters = {
    'image': ImageConverter(),
    'media': MediaConverter(),
    'document': DocumentConverter(),
    'data': DataConverter(),
    'pdf': PdfConverter(),
    'excel': ExcelConverter(),
}

SUPPORTED_FORMATS = {
    'image':    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'],
    'media':    ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'webm', 'flv', 'ts', 'mpeg', 'mpg', 'm4v',
                 'mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg', 'wma', 'opus', 'aiff'],
    'document': ['docx', 'pptx', 'hwp', 'hwpx'],
    'pdf':      ['pdf'],
    'data':     ['csv', 'xml'],
    'excel':    ['xlsx', 'xls', 'xlsm', 'ods', 'tsv', 'numbers', 'json'],
}

history: list[dict] = []


def get_category(ext: str) -> str | None:
    ext = ext.lower().lstrip('.')
    for category, exts in SUPPORTED_FORMATS.items():
        if ext in exts:
            return category
    return None


def handle(msg: dict) -> dict:
    action = msg.get('action')
    req_id = msg.get('id')

    try:
        if action == 'get_formats':
            return {'id': req_id, 'ok': True, 'data': SUPPORTED_FORMATS}

        if action == 'get_history':
            return {'id': req_id, 'ok': True, 'data': history}

        if action == 'clear_history':
            history.clear()
            return {'id': req_id, 'ok': True, 'data': None}

        if action == 'convert':
            file_path: str = msg['filePath']
            target_format: str = msg['targetFormat'].lower().lstrip('.')
            options: dict = msg.get('options', {})

            src_ext = file_path.rsplit('.', 1)[-1].lower()
            category = get_category(src_ext)

            if category is None:
                raise ValueError(f'Unsupported source format: {src_ext}')

            converter = converters[category]
            output_path = converter.convert(file_path, target_format, options)

            entry = {
                'inputPath': file_path,
                'outputPath': output_path,
                'targetFormat': target_format,
                'timestamp': __import__('time').time(),
            }
            history.insert(0, entry)
            if len(history) > 200:
                history.pop()

            return {'id': req_id, 'ok': True, 'data': {'outputPath': output_path}}

        return {'id': req_id, 'ok': False, 'error': f'Unknown action: {action}'}

    except Exception as exc:
        return {'id': req_id, 'ok': False, 'error': str(exc)}


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError as e:
            sys.stderr.write(f'[ipc] JSON parse error: {e}\n')
            continue

        response = handle(msg)
        sys.stdout.write(json.dumps(response) + '\n')
        sys.stdout.flush()


if __name__ == '__main__':
    main()
