// 전역 푸터 - 항공교통본부 저작권·버전 정보 표시
export function AppFooter() {
  return (
    <footer className="py-5 bg-gray-100 text-gray-500 border-t border-gray-200">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-wrap gap-6 items-center justify-center">
          <div className="text-sm font-medium text-gray-700">
            Similar Callsign Sharing System | Korea Airports Corporation
          </div>
          <div className="flex gap-5 text-sm">
            <span className="text-gray-400">항공교통본부</span>
            <div>
              <span className="text-gray-400">T.</span>
              <span className="font-medium ml-1 text-gray-600">053-668-0238</span>
            </div>
            <div>
              <span className="text-gray-400">E.</span>
              <span className="font-medium ml-1 text-gray-600">parkeungi21@korea.kr</span>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-200 mt-3 pt-3 text-xs text-gray-400 text-center">
          © 2026 Korea Airports Corporation. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
}
