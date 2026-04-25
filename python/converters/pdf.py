import fitz  # PyMuPDF
from PIL import Image
from pathlib import Path
from .utils import unique_path


class PdfConverter:
    SUPPORTED_OUT = {'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'}

    def _pixmap_to_pil(self, pix) -> Image.Image:
        mode = 'RGBA' if pix.alpha else 'RGB'
        return Image.frombytes(mode, [pix.width, pix.height], pix.samples)

    def _save(self, pix, out_path: Path, target_format: str, options: dict):
        img = self._pixmap_to_pil(pix)
        fmt = target_format.lower()

        if fmt in ('jpg', 'jpeg'):
            if img.mode in ('RGBA', 'P', 'LA'):
                img = img.convert('RGB')
            img.save(str(out_path), quality=options.get('jpegQuality', 95), optimize=True)
        elif fmt == 'gif':
            img = img.convert('P', palette=Image.ADAPTIVE)
            img.save(str(out_path))
        elif fmt in ('bmp', 'tiff'):
            if img.mode == 'RGBA':
                img = img.convert('RGB')
            img.save(str(out_path))
        else:
            img.save(str(out_path))

    def convert(self, input_path: str, target_format: str, options: dict = {}) -> str:
        if target_format not in self.SUPPORTED_OUT:
            raise ValueError(f'PDF에서 {target_format}으로 변환은 지원하지 않습니다.')

        src = Path(input_path)
        out_dir = Path(options.get('outputDir') or src.parent)
        ext = 'jpg' if target_format == 'jpeg' else target_format
        dpi = options.get('dpi', 150)
        mat = fitz.Matrix(dpi / 72, dpi / 72)

        doc = fitz.open(str(src))
        page_count = len(doc)

        if page_count == 1:
            pix = doc[0].get_pixmap(matrix=mat)
            out_path = unique_path(out_dir / f'{src.stem}.{ext}')
            self._save(pix, out_path, target_format, options)
            doc.close()
            return str(out_path)

        first_path = None
        for i, page in enumerate(doc):
            pix = page.get_pixmap(matrix=mat)
            out_path = unique_path(out_dir / f'{src.stem}_p{i + 1:02d}.{ext}')
            self._save(pix, out_path, target_format, options)
            if first_path is None:
                first_path = out_path

        doc.close()
        return str(first_path)
