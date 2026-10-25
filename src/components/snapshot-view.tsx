import type { ResumeSnapshot } from "../types";
import ResumePreview from "./resume-preview";
import { Modal, ModalHeader } from "./ui";

export default function SnapshotView({
  snapshot,
  onClose,
  application = false,
}: {
  snapshot: ResumeSnapshot;
  application?: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open onClose={onClose} width="max-w-4xl">
      <ModalHeader
        title={application ? "当时投递的简历（只读）" : "查看保存版本（只读）"}
        sub={`${snapshot.label} · ${new Date(
          snapshot.created_at
        ).toLocaleString()} · ${snapshot.resume.title}`}
        onClose={onClose}
      />
      <div className="max-h-[75vh] overflow-auto px-5 pb-5">
        {application && <p className="mb-3 text-[13px] text-ink-600">这是本条投递关联的固定版本，后续编辑当前简历不会改变这里的内容。</p>}
        {snapshot.summary && (
          <p className="mb-3 text-[12px] text-ink-500">{snapshot.summary}</p>
        )}
        <ResumePreview resume={snapshot.resume} />
        {snapshot.jd && (
          <details className="mt-3 text-[12px]">
            <summary>当时的岗位要求</summary>
            <p className="mt-2 whitespace-pre-wrap">{snapshot.jd.raw_text}</p>
          </details>
        )}
      </div>
    </Modal>
  );
}
