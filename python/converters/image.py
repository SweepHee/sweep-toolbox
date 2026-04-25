import os
from pathlib import Path
from PIL import Image
from .utils import unique_path


class ImageConverter:
    SUPPORTED_OUT = {'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'pdf'}

    def convert(self, input_path: str, target_format: str, options: dict = {}) -> str:
        if target_format not in self.SUPPORTED_OUT:
            raise ValueError(f'Unsupported target format for image: {target_format}')

        src = Path(input_path)
        out_dir = options.get('outputDir') or src.parent
        out_ext = 'jpg' if target_format == 'jpeg' else target_format
        out_path = unique_path(Path(out_dir) / f'{src.stem}.{out_ext}')

        with Image.open(src) as img:
            # Preserve ICC profile
            icc = img.info.get('icc_profile')

            # Convert to RGB for formats that don't support alpha
            if target_format in ('jpg', 'jpeg', 'bmp') and img.mode in ('RGBA', 'P', 'LA'):
                img = img.convert('RGB')

            save_kwargs = {}
            if target_format in ('jpg', 'jpeg'):
                save_kwargs['quality'] = options.get('jpegQuality', 95)
                save_kwargs['optimize'] = True
                if icc:
                    save_kwargs['icc_profile'] = icc

            if target_format == 'pdf':
                if img.mode == 'RGBA':
                    img = img.convert('RGB')
                img.save(out_path, 'PDF', resolution=options.get('dpi', 150))
            else:
                img.save(out_path, **save_kwargs)

        return str(out_path)
