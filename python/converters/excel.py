from pathlib import Path
import pandas as pd
from .utils import unique_path

SUPPORTED_IN  = {'xlsx', 'xls', 'xlsm', 'ods', 'tsv', 'numbers'}
SUPPORTED_OUT = {'xlsx', 'ods', 'csv', 'tsv', 'json', 'xml'}


class ExcelConverter:
    SUPPORTED_IN  = SUPPORTED_IN
    SUPPORTED_OUT = SUPPORTED_OUT

    def convert(self, input_path: str, target_format: str, options: dict = {}) -> str:
        if target_format not in SUPPORTED_OUT:
            raise ValueError(f'지원하지 않는 출력 포맷: {target_format}')

        src = Path(input_path)
        src_ext = src.suffix.lower().lstrip('.')
        out_dir = Path(options.get('outputDir') or src.parent)
        out_path = unique_path(out_dir / f'{src.stem}.{target_format}')

        df = self._read(src, src_ext)
        self._write(df, out_path, target_format)
        return str(out_path)

    def _read(self, path: Path, ext: str) -> pd.DataFrame:
        if ext in ('xlsx', 'xlsm'):
            return pd.read_excel(path, engine='openpyxl')
        if ext == 'xls':
            return pd.read_excel(path, engine='xlrd')
        if ext == 'ods':
            return pd.read_excel(path, engine='odf')
        if ext == 'tsv':
            for enc in ('utf-8-sig', 'cp949', 'utf-16'):
                try:
                    return pd.read_csv(path, sep='\t', encoding=enc)
                except (UnicodeDecodeError, UnicodeError):
                    continue
            return pd.read_csv(path, sep='\t', encoding='utf-8-sig', errors='replace')
        raise ValueError(f'지원하지 않는 입력 포맷: {ext}')

    def _write(self, df: pd.DataFrame, out_path: Path, fmt: str):
        if fmt == 'xlsx':
            df.to_excel(out_path, index=False, engine='openpyxl')
        elif fmt == 'ods':
            df.to_excel(out_path, index=False, engine='odf')
        elif fmt == 'csv':
            df.to_csv(out_path, index=False, encoding='utf-8-sig')
        elif fmt == 'tsv':
            df.to_csv(out_path, index=False, sep='\t', encoding='utf-8-sig')
        elif fmt == 'json':
            df.to_json(out_path, orient='records', force_ascii=False, indent=2)
        elif fmt == 'xml':
            df.to_xml(out_path, index=False)
