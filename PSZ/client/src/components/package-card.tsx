import { CheckIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface PackageFeature {
  text: string;
  icon: string;
}

interface PackageCardProps {
  name: string;
  price: number | string;
  features: PackageFeature[];
  isSelected?: boolean;
  onClick?: () => void;
  color: 'bronze' | 'silver' | 'gold' | 'platinum';
  duration?: number;
  images?: number;
  locations?: number;
  showImagePlus?: boolean;
  imageDescription?: string;
}

export default function PackageCard({ 
  name, 
  price, 
  features, 
  isSelected = false, 
  onClick,
  color,
  duration,
  images,
  locations,
  showImagePlus = false,
  imageDescription = "retouched images"
}: PackageCardProps) {
  const colorClasses = {
    bronze: 'text-orange-600 hover:border-orange-600',
    silver: 'text-gray-600 hover:border-gray-600',
    gold: 'text-jamaica-gold hover:border-jamaica-gold',
    platinum: 'text-jamaica-green hover:border-jamaica-green',
  };

  const selectedClasses = isSelected ? 'border-primary bg-primary/5 shadow-lg' : 'border-transparent';

  return (
    <Card 
      className={`package-card rounded-xl p-6 cursor-pointer hover-3d transition-all duration-300 ${selectedClasses} ${colorClasses[color]}`}
      onClick={onClick}
      data-testid={`package-card-${name.toLowerCase()}`}
    >
      <div className="text-center">
        <div className={`text-lg font-bold mb-2 ${colorClasses[color]}`}>
          {name}
        </div>
        
        <div className="text-3xl font-bold mb-4 counter-animation pricing-pulse">
          {typeof price === 'number' ? `$${price}` : price}
        </div>

        {(duration || images || locations) && (
          <div className="text-sm text-muted-foreground space-y-2 text-left mb-4">
            {duration && (
              <div className="flex items-center" data-testid={`duration-${name.toLowerCase()}`}>
                <i className={`fas fa-clock w-4 mr-2 ${colorClasses[color]}`}></i> 
                {duration === 0 ? 'Full Day Coverage' : duration <= 24 ? `${duration} hours` : `${duration} minutes`}
              </div>
            )}
            {images && (
              <div className="flex items-center" data-testid={`images-${name.toLowerCase()}`}>
                <i className={`fas fa-images w-4 mr-2 ${colorClasses[color]}`}></i> 
                {images}{showImagePlus ? '+' : ''} {imageDescription}
              </div>
            )}
            {locations && (
              <div className="flex items-center" data-testid={`locations-${name.toLowerCase()}`}>
                <i className={`fas fa-map-marker-alt w-4 mr-2 ${colorClasses[color]}`}></i> 
                {locations} location{locations > 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}

        {features.length > 0 && (
          <ul className="text-sm text-muted-foreground space-y-2 text-left">
            {features.map((feature, index) => (
              <li key={index} className="flex items-center" data-testid={`feature-${index}-${name.toLowerCase()}`}>
                <CheckIcon className={`w-4 h-4 mr-2 ${colorClasses[color]}`} />
                {feature.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
