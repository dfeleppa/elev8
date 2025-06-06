/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'hsl(220, 100%, 97%)',
          100: 'hsl(220, 100%, 95%)',
          200: 'hsl(220, 95%, 90%)',
          300: 'hsl(220, 90%, 80%)',
          400: 'hsl(220, 85%, 70%)',
          500: 'hsl(220, 80%, 60%)',
          600: 'hsl(220, 75%, 50%)',
          700: 'hsl(220, 70%, 40%)',
          800: 'hsl(220, 65%, 30%)',
          900: 'hsl(220, 60%, 20%)',
        },
        success: {
          50: 'hsl(150, 100%, 97%)',
          100: 'hsl(150, 95%, 90%)',
          200: 'hsl(150, 90%, 80%)',
          300: 'hsl(150, 85%, 70%)',
          400: 'hsl(150, 80%, 60%)',
          500: 'hsl(150, 75%, 50%)',
          600: 'hsl(150, 70%, 40%)',
          700: 'hsl(150, 65%, 30%)',
          800: 'hsl(150, 60%, 25%)',
          900: 'hsl(150, 55%, 20%)',
        },
        warning: {
          50: 'hsl(45, 100%, 96%)',
          100: 'hsl(45, 95%, 90%)',
          200: 'hsl(45, 90%, 80%)',
          300: 'hsl(45, 85%, 70%)',
          400: 'hsl(45, 80%, 60%)',
          500: 'hsl(45, 75%, 50%)',
          600: 'hsl(45, 70%, 40%)',
          700: 'hsl(45, 65%, 30%)',
          800: 'hsl(45, 60%, 25%)',
          900: 'hsl(45, 55%, 20%)',
        },
        danger: {
          50: 'hsl(0, 100%, 97%)',
          100: 'hsl(0, 95%, 90%)',
          200: 'hsl(0, 90%, 80%)',
          300: 'hsl(0, 85%, 70%)',
          400: 'hsl(0, 80%, 60%)',
          500: 'hsl(0, 75%, 50%)',
          600: 'hsl(0, 70%, 40%)',
          700: 'hsl(0, 65%, 30%)',
          800: 'hsl(0, 60%, 25%)',
          900: 'hsl(0, 55%, 20%)',
        },
        gray: {
          50: 'hsl(210, 20%, 98%)',
          100: 'hsl(210, 15%, 95%)',
          200: 'hsl(210, 15%, 90%)',
          300: 'hsl(210, 10%, 80%)',
          400: 'hsl(210, 10%, 70%)',
          500: 'hsl(210, 10%, 60%)',
          600: 'hsl(210, 10%, 50%)',
          700: 'hsl(210, 10%, 40%)',
          800: 'hsl(210, 10%, 30%)',
          900: 'hsl(210, 10%, 20%)',
        }
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        none: 'none',
      },
      spacing: {
        '72': '18rem',
        '80': '20rem',
        '96': '24rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};