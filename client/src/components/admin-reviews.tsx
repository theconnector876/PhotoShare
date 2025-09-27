import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, CheckCircle, X, Eye } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";

interface Review {
  id: string;
  clientName: string;
  clientEmail: string;
  rating: number;
  reviewText: string;
  reviewType: string;
  catalogueId: string | null;
  isApproved: boolean;
  createdAt: string;
}

export function AdminReviews() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved">("all");

  const { data: reviews, isLoading } = useQuery<Review[]>({
    queryKey: ["/api/admin/reviews"],
    retry: false,
  });

  const approveReviewMutation = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      await apiRequest(`/api/admin/reviews/${id}/approve`, "PATCH", { approve });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({
        title: "Review Updated",
        description: "Review approval status has been updated successfully.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/auth";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update review approval.",
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (isApproved: boolean) => {
    return isApproved ? "bg-green-500" : "bg-orange-500";
  };

  const StarRating = ({ rating }: { rating: number }) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
            }`}
          />
        ))}
      </div>
    );
  };

  const filteredReviews = reviews?.filter((review) => {
    if (filterStatus === "pending") return !review.isApproved;
    if (filterStatus === "approved") return review.isApproved;
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5" />
                Review Management
              </CardTitle>
              <CardDescription>
                Approve and manage client reviews for display on the website.
              </CardDescription>
            </div>
            <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter reviews" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reviews</SelectItem>
                <SelectItem value="pending">Pending Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {filteredReviews?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {filterStatus === "all" ? "No reviews found." : `No ${filterStatus} reviews found.`}
              </div>
            ) : (
              filteredReviews?.map((review: Review) => (
                <Card key={review.id} className="relative">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-lg">{review.clientName}</h4>
                          <Badge
                            className={`text-white ${getStatusColor(review.isApproved)}`}
                            data-testid={`badge-status-${review.id}`}
                          >
                            {review.isApproved ? "Approved" : "Pending"}
                          </Badge>
                          <Badge variant="outline">
                            {review.reviewType === "catalogue" ? "Catalogue Review" : "General Review"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <StarRating rating={review.rating} />
                          <span className="text-sm text-gray-500">
                            {formatDate(review.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{review.clientEmail}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedReview(review)}
                          data-testid={`button-view-${review.id}`}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        {!review.isApproved && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => approveReviewMutation.mutate({ id: review.id, approve: true })}
                            disabled={approveReviewMutation.isPending}
                            data-testid={`button-approve-${review.id}`}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                        )}
                        {review.isApproved && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => approveReviewMutation.mutate({ id: review.id, approve: false })}
                            disabled={approveReviewMutation.isPending}
                            data-testid={`button-unapprove-${review.id}`}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Unapprove
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-gray-700 leading-relaxed">{review.reviewText}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Review Detail Modal */}
      {selectedReview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold">Review Details</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedReview(null)}
                  data-testid="button-close-modal"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Client Name</label>
                  <p className="text-lg">{selectedReview.clientName}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p>{selectedReview.clientEmail}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Rating</label>
                  <div className="flex items-center gap-2">
                    <StarRating rating={selectedReview.rating} />
                    <span>({selectedReview.rating}/5)</span>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Review Type</label>
                  <p>{selectedReview.reviewType === "catalogue" ? "Catalogue Review" : "General Review"}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <Badge className={`${getStatusColor(selectedReview.isApproved)} text-white`}>
                    {selectedReview.isApproved ? "Approved" : "Pending Approval"}
                  </Badge>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Submitted</label>
                  <p>{formatDate(selectedReview.createdAt)}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Review Text</label>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="leading-relaxed">{selectedReview.reviewText}</p>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-4">
                  {!selectedReview.isApproved ? (
                    <Button
                      onClick={() => {
                        approveReviewMutation.mutate({ id: selectedReview.id, approve: true });
                        setSelectedReview(null);
                      }}
                      disabled={approveReviewMutation.isPending}
                      data-testid="button-approve-modal"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve Review
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        approveReviewMutation.mutate({ id: selectedReview.id, approve: false });
                        setSelectedReview(null);
                      }}
                      disabled={approveReviewMutation.isPending}
                      data-testid="button-unapprove-modal"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Unapprove Review
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}