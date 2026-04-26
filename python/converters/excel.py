from pathlib import Path
import pandas as pd
from .utils import unique_path

SUPPORTED_IN  = {'xlsx', 'xls', 'xlsm', 'ods', 'tsv', 'numbers', 'json'}
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
        if ext == 'numbers':
            return self._read_numbers(path)
        if ext == 'json':
            return pd.read_json(path)
        raise ValueError(f'지원하지 않는 입력 포맷: {ext}')

    def _read_numbers(self, path: Path) -> pd.DataFrame:
        from numbers_parser import Document
        doc = Document(str(path))
        sheet = doc.sheets[0]
        table = sheet.tables[0]
        rows = table.rows(values_only=True)

        if not rows:
            return pd.DataFrame()

        # 빈 trailing 열 제거
        max_col = max(
            (i for row in rows for i, v in enumerate(row) if v is not None),
            default=0,
        )
        rows = [row[:max_col + 1] for row in rows]

        # 빈 trailing 행 제거
        while rows and all(v is None for v in rows[-1]):
            rows.pop()

        if len(rows) < 2:
            return pd.DataFrame()

        headers = [str(h) if h is not None else f'Col{i}' for i, h in enumerate(rows[0])]
        df = pd.DataFrame(rows[1:], columns=headers)

        # float 열 중 실질적으로 정수인 것을 int로 변환 (numbers-parser 부동소수점 보정)
        for col in df.select_dtypes(include='float64').columns:
            non_null = df[col].dropna()
            if len(non_null) > 0 and (abs(non_null - non_null.round()) < 1e-6).all():
                df[col] = df[col].round().astype('Int64')

        return df

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
