export interface PreflightOccurrence {
  occurredDate: string;
  occurredTime: string;
  errorType: string;
  subError: string;
}

export interface PreflightSearchResult {
  callsignPair: string;
  myCallsign: string;
  otherCallsign: string;
  airlineCode: string;
  otherAirlineCode: string;
  riskLevel: string;
  similarity: string;
  sector: string;
  coexistenceMinutes: number;
  occurrenceCount: number;
  sameDayOccurrences: PreflightOccurrence[];
  sameDayCount: number;
}

export interface PreflightSearchResponse {
  data: {
    searchedCallsign: string;
    dayOfWeek: string;
    dayOfWeekIndex: number;
    totalMatches: number;
    results: PreflightSearchResult[];
  };
  success: boolean;
}
