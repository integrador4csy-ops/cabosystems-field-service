import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CompanyEventModal} from '@/components/agenda/CompanyEventModal';
import {COMPANY_AGENDA_COPY} from '@/lib/companyAgendaCopy';
import {NO_RECURRENCE} from '@/lib/companyAgendaRecurrence';
import '../mobile-agenda-preview/preview.css';
function Preview(){
 const [open,setOpen]=useState(true);
 const params=new URLSearchParams(location.search), en=params.get('lang')==='en', mode=params.get('mode');
 const event={...NO_RECURRENCE,id:'preview',titulo:'Prueba de sincronización',fecha:'2026-11-11',hora:'09:00',hora_fin:'18:00',tipo:'evento' as const,ubicacion:'CaboSystems',descripcion:'Esto es una prueba para ver la sincronización de Google Calendar.',created_at:'',google:{calendarId:'preview',calendarName:'Integrador Cuatro',endDate:'2026-11-11',endTime:'18:00',editable:true}};
 return open?<CompanyEventModal event={mode==='new'?null:event} day="2026-11-11" canManage={mode==='edit'||mode==='new'} copy={COMPANY_AGENDA_COPY[en?'en':'es']} locale={en?'en-US':'es-MX'} onClose={()=>setOpen(false)} onSave={async()=>{}} onDelete={async()=>{}}/>:<button onClick={()=>setOpen(true)}>Abrir evento de prueba</button>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
