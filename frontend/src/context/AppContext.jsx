import React, { createContext, useState, useEffect } from "react";
import axios from "axios";
import { useContext } from "react";

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);


  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${server}/api/v1/me`, {
        withCredentials: true, 
      });
      setData(response.data); 
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  
  useEffect(() => {
    fetchData();
  }, []);

  return (
    <AppContext.Provider value={{ data, loading, error, fetchData }}>
      {children}
    </AppContext.Provider>
  );
};

export const AppData = ()=>{
    const context = useContext(AppContext);
    if (!context) {
        throw new Error("AppData must be used within an AppProvider")
    }
    return context;
}
