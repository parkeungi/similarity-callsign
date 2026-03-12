// 공지사항 탭 - AirlineAnnouncementList 래핑, 항공사 대시보드 내 공지 영역
'use client';

import React from 'react';
import { Announcement } from '@/types/announcement';
import { AirlineAnnouncementList } from '../AirlineAnnouncementList';

interface AnnouncementsTabProps {
  activeAnnouncements: Announcement[];
  activeAnnouncementsLoading: boolean;
  totalActiveAnnouncements: number;
}

export function AnnouncementsTab({
  activeAnnouncements,
  activeAnnouncementsLoading,
  totalActiveAnnouncements,
}: AnnouncementsTabProps) {
  return (
    <div className="animate-fade-in pb-12">
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 p-8">
        <AirlineAnnouncementList
          title="공지사항"
          subtitle="전체 공지사항을 확인하세요"
          showSearch={true}
          showLevelFilter={true}
          showStatusFilter={false}
          defaultLimit={10}
          initialStatus="all"
        />
      </div>
    </div>
  );
}
