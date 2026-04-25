import json
import xml.etree.ElementTree as ET
from pathlib import Path
import pandas as pd
from .utils import unique_path


class DataConverter:
    SUPPORTED_FORMATS = {'csv', 'xlsx', 'json', 'xml'}

    def convert(self, input_path: str, target_format: str, options: dict = {}) -> str:
        if target_format not in self.SUPPORTED_FORMATS:
            raise ValueError(f'Unsupported target format for data: {target_format}')

        src = Path(input_path)
        src_ext = src.suffix.lower().lstrip('.')
        out_dir = options.get('outputDir') or src.parent
        out_path = unique_path(Path(out_dir) / f'{src.stem}.{target_format}')

        df = self._read(src, src_ext)
        self._write(df, out_path, target_format)
        return str(out_path)

    def _read(self, path: Path, ext: str) -> pd.DataFrame:
        if ext == 'csv':
            return pd.read_csv(path)
        if ext == 'xlsx':
            return pd.read_excel(path)
        if ext == 'json':
            return pd.read_json(path)
        if ext == 'xml':
            return pd.read_xml(path)
        raise ValueError(f'Unsupported source format for data: {ext}')

    def _write(self, df: pd.DataFrame, out_path: Path, fmt: str):
        if fmt == 'csv':
            df.to_csv(out_path, index=False)
        elif fmt == 'xlsx':
            df.to_excel(out_path, index=False)
        elif fmt == 'json':
            df.to_json(out_path, orient='records', force_ascii=False, indent=2)
        elif fmt == 'xml':
            df.to_xml(out_path, index=False)
