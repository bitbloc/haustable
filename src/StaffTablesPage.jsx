/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TableManager from './components/shared/TableManager'
import StaffTableList from './staff/StaffTableList'
import './StaffDashboard.css'

/* Staff floor: a plain list of tables that opens each table's bill.
   Seating, moving, extending, releasing and manual bookings stay in the table manager, one tap away. */
export default function StaffTablesPage() {
    const navigate = useNavigate()
    const [manage, setManage] = useState(false)
    const openBill = (table) => navigate(`/staff/tables/${table.id}`)

    return (
        <div className={`staff-dash ${manage ? '' : 'staff-remote'}`}>
            <header className="sd-top">
                <div className="sd-top__bar">
                    <div className="sd-wrap sd-top__row">
                        <div className="sd-brand">
                            <button type="button" className="sd-quiet sd-top__back" onClick={() => (manage ? setManage(false) : navigate('/staff'))}>กลับ</button>
                            <h1 className="sd-top__title">{manage ? 'จัดการโต๊ะ' : 'โต๊ะ'}</h1>
                        </div>
                        {!manage && (
                            <button type="button" className="sd-quiet sd-top__end" onClick={() => setManage(true)}>จัดการโต๊ะ</button>
                        )}
                    </div>
                </div>
            </header>
            {manage
                ? <TableManager isStaffView={true} onOpenBill={openBill} />
                : <StaffTableList onOpenTable={openBill} />}
        </div>
    )
}
