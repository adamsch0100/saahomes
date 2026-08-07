import React from "react";

export function PageDetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="bg-black pt-24 sm:pt-28 pb-6">
        <div className="max-w-7xl mx-auto px-4 space-y-3">
          <div className="h-8 w-2/3 max-w-md bg-white/10 rounded" />
          <div className="h-7 w-40 bg-[#CFB36E]/30 rounded" />
          <div className="h-4 w-64 bg-white/10 rounded" />
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-6">
          <div className="aspect-[16/9] rounded-xl bg-white/10" />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-10 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-32 bg-gray-100 rounded-lg" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg" />
            ))}
          </div>
          <div className="h-48 bg-gray-100 rounded-lg" />
        </div>
        <div className="hidden lg:block h-80 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}

export function PanelDetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[16/10] bg-gray-200" />
      <div className="p-4 sm:p-6 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-6 w-40 bg-gray-200 rounded" />
          <div className="h-24 bg-gray-100 rounded-lg" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-lg" />
            ))}
          </div>
          <div className="h-40 bg-gray-100 rounded-lg" />
        </div>
        <div className="hidden lg:block h-72 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}
