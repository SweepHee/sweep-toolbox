import DropZone from '@/components/converter/DropZone';

export default function Home() {
  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">파일 변환</h1>
        <p className="text-white/40 text-sm mt-1">파일을 드래그하거나 클릭해서 변환을 시작하세요</p>
      </div>
      <DropZone />
    </div>
  );
}
