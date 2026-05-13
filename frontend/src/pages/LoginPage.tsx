import React from 'react';
import LoginForm from '../components/auth/LoginForm';

const LoginPage: React.FC = () => {
  return (
    <div className="login-page">
      <div className="login-background"></div>
      <div className="login-container">
        <LoginForm />
      </div>
    </div>
  );
};

export default LoginPage;
