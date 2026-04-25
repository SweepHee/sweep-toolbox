from pathlib import Path
import ffmpeg
from .utils import unique_path

AUDIO_FORMATS = {'mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg', 'wma', 'opus', 'aiff'}
VIDEO_FORMATS = {'mp4', 'avi', 'mkv', 'mov', 'wmv', 'webm', 'flv', 'ts', 'mpeg', 'mpg', 'm4v'}

# 출력 포맷별 인코딩 설정
VIDEO_CODEC = {
    'mp4':  {'vcodec': 'libx264', 'acodec': 'aac'},
    'mkv':  {'vcodec': 'libx264', 'acodec': 'aac'},
    'mov':  {'vcodec': 'libx264', 'acodec': 'aac'},
    'avi':  {'vcodec': 'libx264', 'acodec': 'aac', 'pix_fmt': 'yuv420p'},
    'wmv':  {'vcodec': 'wmv2',    'acodec': 'wmav2'},
    'webm': {'vcodec': 'libvpx-vp9', 'acodec': 'libopus'},
    'flv':  {'vcodec': 'libx264', 'acodec': 'aac'},
    'ts':   {'vcodec': 'libx264', 'acodec': 'aac'},
}

AUDIO_CODEC = {
    'mp3':  {'acodec': 'libmp3lame'},
    'wav':  {'acodec': 'pcm_s16le'},
    'aac':  {'acodec': 'aac'},
    'flac': {'acodec': 'flac'},
    'm4a':  {'acodec': 'aac'},
    'ogg':  {'acodec': 'libvorbis'},
    'wma':  {'acodec': 'wmav2'},
    'opus': {'acodec': 'libopus'},
    'aiff': {'acodec': 'pcm_s16be'},
}


class MediaConverter:
    SUPPORTED_IN  = AUDIO_FORMATS | VIDEO_FORMATS
    SUPPORTED_OUT = AUDIO_FORMATS | VIDEO_FORMATS

    def _has_video_stream(self, input_path: str) -> bool:
        probe = ffmpeg.probe(input_path)
        return any(s['codec_type'] == 'video' for s in probe['streams'])

    def convert(self, input_path: str, target_format: str, options: dict = {}) -> str:
        if target_format not in self.SUPPORTED_OUT:
            raise ValueError(f'지원하지 않는 출력 포맷: {target_format}')

        src = Path(input_path)
        out_dir = Path(options.get('outputDir') or src.parent)
        out_path = unique_path(out_dir / f'{src.stem}.{target_format}')

        src_has_video = self._has_video_stream(str(src))
        tgt_is_audio  = target_format in AUDIO_FORMATS

        if not tgt_is_audio and not src_has_video:
            raise ValueError(f'오디오 파일을 {target_format} 영상으로 변환할 수 없습니다.')

        stream = ffmpeg.input(str(src))
        kwargs = {}

        if tgt_is_audio:
            kwargs['vn'] = None  # 비디오 스트림 제거
            kwargs.update(AUDIO_CODEC.get(target_format, {}))
            if target_format == 'mp3':
                kwargs['audio_bitrate'] = options.get('audioBitrate', '192k')
        else:
            kwargs.update(VIDEO_CODEC.get(target_format, {}))
            if target_format in ('mp4', 'mkv', 'mov', 'avi', 'flv', 'ts', 'webm'):
                kwargs['crf'] = options.get('crf', 23)
            vsync = options.get('vsync', 'vfr')
            if target_format == 'avi' or vsync == 'cfr':
                kwargs['vsync'] = 'cfr'

        ffmpeg.output(stream, str(out_path), **kwargs).run(quiet=True, overwrite_output=True)
        return str(out_path)
