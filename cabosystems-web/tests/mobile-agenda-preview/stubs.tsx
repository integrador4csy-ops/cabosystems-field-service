import React from 'react';
export const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });
export const useTranslation = () => ({ language: new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'es' });
export const HeaderCaboSystems = () => null;
