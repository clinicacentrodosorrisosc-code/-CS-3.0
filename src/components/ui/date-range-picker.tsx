import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Calendar as CalendarIcon } from 'lucide-react';

interface DateRangePickerProps {
    value: { start: string; end: string };
    onChange: (range: { start: string; end: string }) => void;
    className?: string;
}

export function DateRangePicker({ value, onChange, className = '' }: DateRangePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Initialize current month based on value.start
    useEffect(() => {
        if (value.start) {
            const date = new Date(value.start + 'T00:00:00');
            if (!isNaN(date.getTime())) {
                setTimeout(() => setCurrentMonth(date), 0);
            }
        }
    }, [value.start]);

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        return { days, firstDay };
    };

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const handleDateClick = (day: number) => {
        // Construct date string manually to avoid timezone shifts
        const year = currentMonth.getFullYear();
        const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const dateString = `${year}-${month}-${dayStr}`;

        if (!value.start || (value.start && value.end)) {
            // Start new selection
            onChange({ start: dateString, end: '' });
        } else {
            // Complete selection
            const startDate = new Date(value.start);
            const clickedDate = new Date(dateString);

            if (clickedDate < startDate) {
                onChange({ start: dateString, end: value.start });
            } else {
                onChange({ start: value.start, end: dateString });
            }
            // Keep open for better UX or close? The image implies a persistent picker until satisfied.
        }
    };

    const isSelected = (day: number) => {
        const year = currentMonth.getFullYear();
        const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const dateString = `${year}-${month}-${dayStr}`;
        return value.start === dateString || value.end === dateString;
    };

    const isInRange = (day: number) => {
        if (!value.start || !value.end) return false;
        
        const year = currentMonth.getFullYear();
        const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const dateString = `${year}-${month}-${dayStr}`;
        
        return dateString > value.start && dateString < value.end;
    };

    const isStart = (day: number) => {
        const year = currentMonth.getFullYear();
        const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const dateString = `${year}-${month}-${dayStr}`;
        return value.start === dateString;
    };

    const isEnd = (day: number) => {
        const year = currentMonth.getFullYear();
        const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const dateString = `${year}-${month}-${dayStr}`;
        return value.end === dateString;
    };

    const formatDateRange = () => {
        if (!value.start) return 'Select dates';
        
        const start = new Date(value.start + 'T00:00:00');
        const startStr = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start);
        
        if (!value.end) return startStr;
        
        const end = new Date(value.end + 'T00:00:00');
        const endStr = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(end);
        
        return `${startStr} - ${endStr}`;
    };

    const { days, firstDay } = getDaysInMonth(currentMonth);
    const daysArray = Array.from({ length: days }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

    const monthName = currentMonth.toLocaleString('default', { month: 'long' });
    const year = currentMonth.getFullYear();

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {/* Trigger Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-between gap-2 bg-surface border border-border rounded-lg px-2.5 py-1 text-text text-[10px] font-bold hover:bg-panel transition-all w-full min-w-[150px] shadow-sm group ${className}`}
            >
                <div className="flex items-center gap-1.5">
                    <CalendarIcon className="w-3 h-3 text-slate-400 group-hover:text-text transition-colors" />
                    <span className="tracking-wide">{formatDateRange()}</span>
                </div>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Popover Calendar */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 bg-surface border border-border rounded-2xl p-4 shadow-2xl z-50 w-[280px] animate-in fade-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-4 px-1">
                        <button onClick={handlePrevMonth} className="p-1.5 hover:bg-panel rounded-lg text-slate-400 hover:text-text transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-1 text-sm font-bold text-text">
                            <span>{monthName}</span>
                            <span className="text-slate-500">{year}</span>
                        </div>
                        <button onClick={handleNextMonth} className="p-1.5 hover:bg-panel rounded-lg text-slate-400 hover:text-text transition-colors">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Week Days */}
                    <div className="grid grid-cols-7 mb-2">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                            <div key={day} className="text-center text-[10px] font-bold text-slate-500 uppercase py-1">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-y-1">
                        {emptyDays.map(i => (
                            <div key={`empty-${i}`} />
                        ))}
                        {daysArray.map(day => {
                            const selected = isSelected(day);
                            const inRange = isInRange(day);
                            const start = isStart(day);
                            const end = isEnd(day);
                            
                            // Style Logic
                            let bgClass = 'hover:bg-panel text-slate-300';
                            let roundedClass = 'rounded-lg';
                            
                            if (selected) {
                                bgClass = 'bg-white text-black font-bold shadow-lg scale-105 z-10';
                            } else if (inRange) {
                                bgClass = 'bg-panel/80 text-text';
                                roundedClass = 'rounded-none';
                            }

                            if (start && value.end) roundedClass = 'rounded-l-lg rounded-r-none';
                            if (end && value.start) roundedClass = 'rounded-r-lg rounded-l-none';
                            if (selected && !value.end && !value.start) roundedClass = 'rounded-lg'; // Single selection (start only)

                            return (
                                <button
                                    key={day}
                                    onClick={() => handleDateClick(day)}
                                    className={`
                                        h-8 w-full text-xs font-medium relative flex items-center justify-center transition-all
                                        ${bgClass}
                                        ${roundedClass}
                                    `}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
