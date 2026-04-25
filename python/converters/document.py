"""
Office document conversion via bundled LibreOffice.
HWP/HWPX conversion is handled server-side (see docs).
"""

import os
import subprocess
from pathlib import Path
from .utils import unique_path


class DocumentConverter:
    LIBREOFFICE_PATHS = [
        # Windows
        r'C:\Program Files\LibreOffice\program\soffice.exe',
        r'C:\Program Files (x86)\LibreOffice\program\soffice.exe',
        # macOS
        '/Applications/LibreOffice.app/Contents/MacOS/soffice',
        # Linux
        'libreoffice',
        'soffice',
    ]
    SUPPORTED_IN = {'docx', 'pptx', 'xlsx', 'odt', 'ods', 'odp'}
    SUPPORTED_OUT = {'pdf'}

    def _find_libreoffice(self) -> str:
        for p in self.LIBREOFFICE_PATHS:
            if os.path.isfile(p) or os.path.isabs(p) is False:
                return p
        raise RuntimeError(
            'LibreOffice not found. Please install LibreOffice.'
        )

    def convert(self, input_path: str, target_format: str, options: dict = {}) -> str:
        src_ext = Path(input_path).suffix.lower().lstrip('.')
        if src_ext in ('hwp', 'hwpx'):
            raise ValueError('HWP/HWPX 변환은 서버 처리가 필요합니다.')
        if target_format not in self.SUPPORTED_OUT:
            raise ValueError(f'Unsupported target format for document: {target_format}')

        src = Path(input_path)
        out_dir = options.get('outputDir') or str(src.parent)
        soffice = self._find_libreoffice()

        subprocess.run(
            [soffice, '--headless', '--convert-to', target_format,
             '--outdir', out_dir, str(src)],
            check=True,
            capture_output=True,
        )

        # LibreOffice가 고정 이름으로 저장하므로 변환 후 rename
        libreoffice_out = Path(out_dir) / f'{src.stem}.{target_format}'
        final_path = unique_path(libreoffice_out)
        if final_path != libreoffice_out:
            libreoffice_out.rename(final_path)
        return str(final_path)
