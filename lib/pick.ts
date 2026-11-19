// <input type="file"> 대신 브라우저 내장 파일 선택창(File System Access API)을 사용한다.
// 반환: File[] = 선택 결과, [] = 사용자가 취소, null = 지원하지 않거나 실패 (호출 측에서 <input>으로 대체)
export async function pickFiles(opts: {
  description: string;
  accept: Record<string, string[]>;
  multiple?: boolean;
}): Promise<File[] | null> {
  const w = window as unknown as {
    showOpenFilePicker?: (o: unknown) => Promise<{ getFile: () => Promise<File> }[]>;
  };
  if (!w.showOpenFilePicker) return null;
  try {
    const handles = await w.showOpenFilePicker({
      multiple: !!opts.multiple,
      types: [{ description: opts.description, accept: opts.accept }],
    });
    return await Promise.all(handles.map((h) => h.getFile()));
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") return [];
    return null;
  }
}
