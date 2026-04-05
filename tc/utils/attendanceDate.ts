const ATTENDANCE_TIME_ZONE = 'Asia/Kolkata';

const attendanceDateFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: ATTENDANCE_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
});

const attendanceApiDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ATTENDANCE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

const getDatePart = (parts: Intl.DateTimeFormatPart[], type: 'year' | 'month' | 'day') =>
    parts.find((part) => part.type === type)?.value || '';

export const toAttendanceApiDate = (date: Date) => {
    const parts = attendanceApiDateFormatter.formatToParts(date);

    return `${getDatePart(parts, 'year')}-${getDatePart(parts, 'month')}-${getDatePart(parts, 'day')}`;
};

export const formatStoredAttendanceDate = (dateValue: string | Date) => {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return attendanceDateFormatter.format(date);
};
