import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'   // use App instead of Dashboard
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
// date,patient,amount,claim_status,id,billed,paid,reason,payer,aging,month,actual,target,client,gcr,name,value,label,is_clean_claim,charge_date,billing_date,adjusted_billed,denied,deniedAmount,denialReason,total_claims,first_pass_claims
