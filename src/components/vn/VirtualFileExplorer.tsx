import React, { useState } from 'react';
import { FileCode, FileText, Folder, Lock, RotateCcw, Trash2, X } from 'lucide-react';
import { formatStoryText } from '../../data/millenniumScript';
import { VirtualFile } from '../../types/vn';

interface VirtualFileExplorerProps {
  files: VirtualFile[];
  playerName?: string;
  contained?: boolean;
  onClose: () => void;
  onDeleteFile: (fileId: string) => void;
  onRestoreFile: (fileId: string) => void;
}

export const VirtualFileExplorer: React.FC<VirtualFileExplorerProps> = ({
  files,
  playerName = 'Observer_00',
  contained = false,
  onClose,
  onDeleteFile,
  onRestoreFile,
}) => {
  const [selectedFolder, setSelectedFolder] = useState<
    'all' | 'system' | 'archives' | 'quarantine'
  >('all');
  const [selectedFileId, setSelectedFileId] = useState<string>(files[0]?.id || '');

  const filtered = files.filter((f) => selectedFolder === 'all' || f.folder === selectedFolder);
  const activeFile = files.find((f) => f.id === selectedFileId) || filtered[0] || null;

  return (
    <div
      className={`${contained ? 'absolute p-2.5' : 'fixed p-4'} inset-0 z-50 flex items-center justify-center bg-black/85`}
    >
      <div
        className={`w-full max-w-5xl rounded-xl bg-[#0B0E14] border border-white/15 shadow-2xl overflow-hidden flex flex-col ${contained ? 'h-[92%]' : 'h-[80vh]'}`}
      >
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#121620] border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <Folder className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-vn-mono text-xs md:text-sm text-zinc-200 truncate">
              C:\ARK_LPT1\{selectedFolder === 'all' ? '' : `${selectedFolder}\\`}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0">
          <aside className="md:col-span-3 border-b md:border-b-0 md:border-r border-white/10 p-4 space-y-1 bg-[#080A0F]">
            <p className="text-xs font-medium text-zinc-500 px-2 pb-2">存储介质文件系统</p>
            {[
              { id: 'all', label: '全部卷宗' },
              { id: 'system', label: 'system/' },
              { id: 'archives', label: 'archives/' },
              { id: 'quarantine', label: 'quarantine/' },
            ].map((dir) => (
              <button
                key={dir.id}
                onClick={() => setSelectedFolder(dir.id as typeof selectedFolder)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-vn-mono transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  selectedFolder === dir.id
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                <Folder className="w-3.5 h-3.5 shrink-0" />
                {dir.label}
              </button>
            ))}
          </aside>

          <section className="md:col-span-4 border-b md:border-b-0 md:border-r border-white/10 overflow-y-auto p-3 space-y-1.5">
            {filtered.map((file) => (
              <button
                key={file.id}
                onClick={() => setSelectedFileId(file.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                  activeFile?.id === file.id
                    ? 'bg-white/10 border-white/25'
                    : 'bg-zinc-900/60 border-white/5 hover:border-white/15'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    {file.folder === 'system' ? (
                      <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                    )}
                    <span
                      className={`font-vn-mono text-xs truncate ${
                        file.deleted ? 'line-through text-zinc-500' : 'text-zinc-100'
                      }`}
                    >
                      {formatStoryText(file.name, playerName)}
                    </span>
                  </span>
                  <span className="text-[11px] font-vn-mono text-zinc-500 shrink-0">
                    {file.size}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-zinc-500 font-vn-mono">
                  <span>{file.folder}/</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {file.deleted
                      ? '已隔离'
                      : file.locked
                        ? '进程锁定'
                        : file.corrupted
                          ? '部分破译'
                          : '可读'}
                  </span>
                </div>
              </button>
            ))}
          </section>

          <section className="md:col-span-5 flex flex-col justify-between p-5 overflow-y-auto bg-[#0A0D13]">
            {activeFile ? (
              <>
                <div className="space-y-4">
                  <div className="pb-3 border-b border-white/10">
                    <h3 className="font-vn-mono text-sm font-semibold text-white">
                      {formatStoryText(activeFile.name, playerName)}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5 font-vn-mono">
                      修改时间：{activeFile.modifiedAt} · 大小：{activeFile.size}
                    </p>
                  </div>
                  {activeFile.deleted ? (
                    <div className="p-4 rounded-lg bg-zinc-900/90 border border-white/10 text-xs text-zinc-400">
                      该文件已移入终端隔离区。
                    </div>
                  ) : (
                    <pre className="p-4 rounded-lg bg-black/80 border border-white/10 font-vn-mono text-xs text-emerald-100 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                      {formatStoryText(
                        !activeFile.corrupted && activeFile.corruptedContent
                          ? `${activeFile.content}\n\n${activeFile.corruptedContent}`
                          : activeFile.content,
                        playerName
                      )}
                    </pre>
                  )}
                </div>

                <div className="pt-5 mt-5 border-t border-white/10 flex items-center justify-between gap-3">
                  {activeFile.deleted ? (
                    <button
                      onClick={() => onRestoreFile(activeFile.id)}
                      className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      恢复文件
                    </button>
                  ) : activeFile.locked ? (
                    <span className="text-xs font-vn-mono text-zinc-400 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-emerald-400" />
                      受 Unit-0924 本地缓存保护
                    </span>
                  ) : (
                    <button
                      onClick={() => onDeleteFile(activeFile.id)}
                      className="px-4 py-2 rounded-lg bg-red-600/85 hover:bg-red-500 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      移入隔离区
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-500">请从左侧选择文件。</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
