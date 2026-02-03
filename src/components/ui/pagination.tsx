'use client';

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-center gap-2 mt-6">
            <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 md:w-10 md:h-10 border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400"
            >
                <ChevronLeft className="w-4 h-4" />
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="icon"
                    onClick={() => onPageChange(page)}
                    className={`w-8 h-8 md:w-10 md:h-10 border-zinc-800 ${currentPage === page
                            ? "bg-primary text-black hover:bg-primary/90"
                            : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
                        }`}
                >
                    {page}
                </Button>
            ))}

            <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 md:w-10 md:h-10 border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400"
            >
                <ChevronRight className="w-4 h-4" />
            </Button>
        </div>
    );
}
