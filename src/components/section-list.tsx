'use client';

import { useState, ReactNode } from 'react';
import { Pagination } from './ui/pagination';

interface SectionListProps {
    title?: string;
    children: ReactNode[];
    itemsPerPage?: number;
    className?: string;
    headerClassName?: string;
}

export function SectionList({
    title,
    children,
    itemsPerPage = 10,
    className = "",
    headerClassName = ""
}: SectionListProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const items = Array.isArray(children) ? children : [children];

    const totalPages = Math.ceil(items.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentItems = items.slice(startIndex, endIndex);

    if (items.length === 0) return null;

    return (
        <section className={`py-8 ${className}`}>
            {title && (
                <header className={`mb-6 ${headerClassName}`}>
                    <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">{title}</h2>
                </header>
            )}

            <div className="flex flex-col gap-4">
                {currentItems.map((child, index) => (
                    <div key={index}>
                        {child}
                    </div>
                ))}
            </div>

            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
            />
        </section>
    );
}
