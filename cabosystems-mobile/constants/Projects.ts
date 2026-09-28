export interface Unit {
  id: string;
  code: string;
  name: string;
}

export interface Development {
  id: string;
  initials: string;
  name: string;
  units: Unit[];
}

export const developments: Development[] = [
  {
    id: 'cds',
    initials: 'CDS',
    name: 'Cabo del Sol',
    units: [
      { id: 'cds-1', code: 'CDS-01', name: 'Villa 01' },
      { id: 'cds-2', code: 'CDS-02', name: 'Villa 02' },
      { id: 'cds-3', code: 'CDS-03', name: 'Villa 03' },
    ],
  },
  {
    id: 'eld',
    initials: 'ELD',
    name: 'El Dorado',
    units: [
      { id: 'eld-1', code: 'ELD-01', name: 'Casa 01' },
      { id: 'eld-2', code: 'ELD-02', name: 'Casa 02' },
    ],
  },
  {
    id: 'cb',
    initials: 'CB',
    name: 'Chileno Bay',
    units: [
      { id: 'cb-ph1', code: 'CB-PH1', name: 'PH1' },
      { id: 'cb-ge51', code: 'CB-GE51', name: 'GE51' },
      { id: 'cb-hs21', code: 'CB-HS21', name: 'HS 21' },
      { id: 'cb-sc09', code: 'CB-SC09', name: 'SC 09' },
    ],
  },
];
