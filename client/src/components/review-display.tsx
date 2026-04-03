import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ChatCircle } from "@phosphor-icons/react";
import { useState } from "react";
import ReviewForm from "./review-form";

interface Review {
  id: string;
  clientName: string;
  rating: number;
  reviewText: string;
  reviewType: string;
  createdAt: string;
}

interface ReviewDisplayProps {
  type: "general" | "catalogue";
  catalogueId?: string;
  catalogueTitle?: string;
  showSubmitForm?: boolean;
  limit?: number;
}

export default function ReviewDisplay({ 
  type, 
  catalogueId, 
  catalogueTitle, 
  showSubmitForm = true, 
  limit 
}: ReviewDisplayProps) {
  const [showForm, setShowForm] = useState(false);

  const { data: reviews, isLoading } = useQuery<Review[]>({
    queryKey: type === "general" ? ["/api/reviews/general"] : ["/api/reviews/catalogue", catalogueId],
    enabled: type === "general" || !!catalogueId,
  });

  const displayReviews = limit ? reviews?.slice(0, limit) : reviews;
  const averageRating = reviews?.length 
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
    : 0;

  const StarRating = ({ rating }: { rating: number }) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            weight={star <= rating ? "fill" : "regular"}
            className={star <= rating ? "text-amber-400" : "text-white/20"}
          />
        ))}
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-white/10 rounded w-1/4 mb-2"></div>
              <div className="h-4 bg-white/10 rounded w-3/4 mb-4"></div>
              <div className="h-16 bg-white/10 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Reviews Summary */}
      {reviews && reviews.length > 0 && (
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <StarRating rating={Math.round(averageRating)} />
            <span className="text-lg font-semibold" data-testid="average-rating">
              {averageRating.toFixed(1)}
            </span>
            <span className="text-muted-foreground" data-testid="review-count">
              ({reviews.length} review{reviews.length !== 1 ? 's' : ''})
            </span>
          </div>
        </div>
      )}

      {/* Submit Review Form */}
      {showSubmitForm && (
        <div className="text-center">
          {!showForm ? (
            <Button
              onClick={() => setShowForm(true)}
              variant="outline"
              className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500"
              data-testid="button-write-review"
            >
              <ChatCircle size={16} className="mr-2" />
              Write a Review
            </Button>
          ) : (
            <div className="space-y-4">
              <ReviewForm
                catalogueId={catalogueId}
                catalogueTitle={catalogueTitle}
                onSuccess={() => setShowForm(false)}
              />
              <Button
                onClick={() => setShowForm(false)}
                variant="ghost"
                data-testid="button-cancel-review"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {displayReviews && displayReviews.length > 0 ? (
          displayReviews.map((review) => (
            <Card key={review.id} className="hover-3d">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-lg" data-testid={`review-name-${review.id}`}>
                      {review.clientName}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <StarRating rating={review.rating} />
                      <span className="text-sm text-muted-foreground">
                        {formatDate(review.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <p 
                  className="text-white/70 leading-relaxed" 
                  data-testid={`review-text-${review.id}`}
                >
                  {review.reviewText}
                </p>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Star size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No reviews yet</h3>
              <p className="text-muted-foreground">
                Be the first to share your experience!
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Show More Link */}
      {limit && reviews && reviews.length > limit && (
        <div className="text-center">
          <Button
            variant="ghost"
            className="text-amber-400 hover:text-amber-300"
            data-testid="button-view-all-reviews"
          >
            View all {reviews.length} reviews
          </Button>
        </div>
      )}
    </div>
  );
}