import React, { useEffect, useMemo } from 'react';
import { useExpenseRegister } from 'path/to/useExpenseRegister'; // update the path accordingly

const AdminExpenseRequests = () => {
    const expenseData = useExpenseRegister();
    const computedData = useMemo(() => {
        // compute values here using expenseData
    }, [expenseData]);

    useEffect(() => {
        loadData();
    }, [loadData]);  // Added 'loadData' to the dependency array

    return (
        <div>
            {computedData.map(data => (
                <div key={data.id}>{data.value}</div>
            ))}
        </div>
    );
};

export default AdminExpenseRequests;