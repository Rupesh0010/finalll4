import React from 'react'
export const Card = ({children, className='', style={}}) => {
  return <div className={`card ${className}`} style={style}>{children}</div>
}
