// Isolated fixture: no network or production data.
export const useSafeAreaInsets = () => ({top:0,bottom:0,left:0,right:0});
export const StatusBar = () => null;
export const HeaderCaboSystems = () => null;
export const useTranslation = () => ({language:'es'});
export const randomUUID = () => crypto.randomUUID();
export const getGoogleCalendars = async () => [];
