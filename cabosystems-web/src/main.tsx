import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Warm the picker and its artwork from startup without delaying the app.
void import('./components/chat/EmojiPicker').catch(() => {});
void import('./lib/emojiPreload').then(({ prepareChatEmojis }) => prepareChatEmojis()).catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
