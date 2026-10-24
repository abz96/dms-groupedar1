"use client";

export default function PrintButton({ label }: { label: string }) {
  return (
    <button className="btn btn-primary !bg-white !text-[#005a96]" onClick={() => window.print()}>
      {label}
    </button>
  );
}
