// Isolated visual fixture; no production database calls.
export type CalendarColors = Record<string,string>;
export const validCalendarColor = (color:string) => /^#[a-f0-9]{6}$/i.test(color);
let colors: CalendarColors = {};
export const getCalendarColors = async () => ({...colors});
export async function saveCalendarColor(_owner:string,id:string,color:string|null) { if(color === null) delete colors[id]; else colors[id] = color; }
