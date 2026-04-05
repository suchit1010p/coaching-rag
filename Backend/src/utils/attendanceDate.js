const ATTENDANCE_DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ATTENDANCE_TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

const istDatePartsFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: ATTENDANCE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

const getFormattedDatePart = (parts, type) => {
    return Number(parts.find((part) => part.type === type)?.value);
};

const getIstDateParts = (date) => {
    const parts = istDatePartsFormatter.formatToParts(date);

    return {
        year: getFormattedDatePart(parts, "year"),
        month: getFormattedDatePart(parts, "month"),
        day: getFormattedDatePart(parts, "day"),
    };
};

const isValidDateParts = (year, month, day) => {
    const utcDate = new Date(Date.UTC(year, month - 1, day));

    return (
        utcDate.getUTCFullYear() === year &&
        utcDate.getUTCMonth() + 1 === month &&
        utcDate.getUTCDate() === day
    );
};

const buildIstAttendanceDate = (year, month, day, endOfDay = false) => {
    if (!isValidDateParts(year, month, day)) {
        return null;
    }

    const utcDateValue = Date.UTC(
        year,
        month - 1,
        day,
        endOfDay ? 23 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 999 : 0
    );

    return new Date(utcDateValue - IST_OFFSET_MS);
};

export const parseAttendanceDate = (value) => {
    if (!value) {
        return null;
    }

    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
            return null;
        }

        const { year, month, day } = getIstDateParts(value);
        return buildIstAttendanceDate(year, month, day);
    }

    if (typeof value === "string") {
        const trimmedValue = value.trim();
        const dateOnlyMatch = trimmedValue.match(ATTENDANCE_DATE_ONLY_PATTERN);

        if (dateOnlyMatch) {
            const [, year, month, day] = dateOnlyMatch;
            return buildIstAttendanceDate(Number(year), Number(month), Number(day));
        }

        const parsedValue = new Date(trimmedValue);

        if (Number.isNaN(parsedValue.getTime())) {
            return null;
        }

        const { year, month, day } = getIstDateParts(parsedValue);
        return buildIstAttendanceDate(year, month, day);
    }

    return null;
};

export const getAttendanceDateRangeEnd = (value) => {
    const normalizedDate = parseAttendanceDate(value);

    if (!normalizedDate) {
        return null;
    }

    const { year, month, day } = getIstDateParts(normalizedDate);

    return buildIstAttendanceDate(year, month, day, true);
};

export const formatAttendanceDate = (value) => {
    const normalizedDate = parseAttendanceDate(value);

    if (!normalizedDate) {
        return "";
    }

    return new Intl.DateTimeFormat("en-IN", {
        timeZone: ATTENDANCE_TIME_ZONE,
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
    }).format(normalizedDate);
};
