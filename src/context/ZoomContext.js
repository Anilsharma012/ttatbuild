import React, { createContext, useContext } from 'react';

const ZoomContext = createContext();

export const ZoomProvider = ({ children }) => {
  const meetings = [];
  const fetchMeetings = async () => {};

  return (
    <ZoomContext.Provider value={{ meetings, fetchMeetings }}>
      {children}
    </ZoomContext.Provider>
  );
};

export const useZoom = () => {
  const context = useContext(ZoomContext);
  if (!context) {
    throw new Error('useZoom must be used within ZoomProvider');
  }
  return context;
};

export default ZoomContext;
