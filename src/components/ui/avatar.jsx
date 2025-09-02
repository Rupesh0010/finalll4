import React from 'react'
export default function Avatar({initials='JD'}) {
  return <div className="avatar" title={initials} style={{width:40,height:40,borderRadius:8,display:'inline-flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>{initials}</div>
}
