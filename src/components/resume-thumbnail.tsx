import type { Resume } from "../types";
import { memo } from "react";
import { A4Sheet } from "./template";

function ResumeThumbnail({ resume }: { resume: Resume }) {
  return (
    <div
      className="resume-thumbnail relative h-56 overflow-hidden rounded-t-xl border-b border-line bg-paper-200"
      aria-hidden="true"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-4"
        style={{
          width: 794,
          transform: "translateX(-50%) scale(0.185)",
          transformOrigin: "top center",
        }}
      >
        <A4Sheet resume={resume} />
      </div>
    </div>
  );
}
export default memo(ResumeThumbnail);
