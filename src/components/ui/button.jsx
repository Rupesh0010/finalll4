import React from 'react'
export const Button = ({children, onClick}) => {
  return <button onClick={onClick} style={{
    background:'grey',
    border:'none',
    color:'rgba(238, 238, 238, 1)',
    padding:'8px 12px',
    borderRadius:10,
    fontWeight:700,
    cursor:'pointer'
  }}>{children}</button>
}
