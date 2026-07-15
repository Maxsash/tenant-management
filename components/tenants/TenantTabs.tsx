import { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import TenantDetails from './TenantDetails';
import PaymentHistoryTab from './PaymentHistoryTab';

interface TenantTabsProps {
  tenant: any;
  onBack: () => void;
}

export default function TenantTabs({ tenant, onBack }: TenantTabsProps) {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': {
              fontSize: '1rem',
              py: 2,
              minHeight: '48px', // Good touch target for mobile
            },
          }}
        >
          <Tab label="Details" />
          <Tab label="Payment History" />
        </Tabs>
      </Box>
      
      <Box sx={{ mt: 2 }}>
        {activeTab === 0 && (
          <TenantDetails 
            tenant={tenant} 
            onBack={onBack} 
            hideBackButton 
          />
        )}
        {activeTab === 1 && (
          <PaymentHistoryTab 
            tenantId={tenant.id} 
          />
        )}
      </Box>
    </Box>
  );
}