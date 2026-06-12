import Spline from '@splinetool/react-spline';

interface LogoLiquidGlassProps {
  onClick?: () => void;
}

export default function LogoLiquidGlass({ onClick }: LogoLiquidGlassProps) {
  return (
    <div className="w-full h-full cursor-pointer" onClick={onClick}>
      <Spline scene="/Logo.splinecode" />
    </div>
  );
}
