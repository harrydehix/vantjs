export type SimpleRealtimeRecord = {
    /**
     * Currently measured pressure related weather data
     */
    pressure: {
        /** Current pressure in inch */
        current: number | null;
        /**
         * The pressure's trend. There are five possible trends:
         *  - Falling Rapidly
         *  - Falling Slowly
         *  - Steady
         *  - Rising Slowly
         *  - Rising Rapidly
         *
         * `trend.value` encodes them as number, `trend.text` as string.
         */
        trend: {
            /**
             * The pressure's trend encoded as number.
             *  - `-60` stands for *Falling Rapidly*
             *  - `-20` stands for *Falling Slowly*
             *  - `0` stands for *Steady*
             *  - `20` stands for *Rising Slowly*
             *  - `60` stands for *Rising Rapidly*
             */
            value: -60 | -20 | 0 | 20 | 60 | null;
            /**
             * The pressure's trend encoded as string.
             * Possible values are `"Falling Rapidly"`, `"Falling Slowly"`, `"Steady"`, `"Rising Slowly"` and `"Rising Rapidly"`.
             */
            text:
                | "Falling Rapidly"
                | "Steady"
                | "Rising Rapidly"
                | "Rising Slowly"
                | "Falling Slowly"
                | null;
        };
    };
    /**
     * Current inside and outside temperature in °F
     */
    temperature: {
        /** Current inside temperature in °F */
        in: number | null;
        /** Current outside temperature in °F */
        out: number | null;
    };
    /** Current inside and outside humidity (relative) in percent  */
    humidity: {
        /** Current inside humidity (relative) in percent */
        in: number | null;
        /** Current outside humidity (relative) in percent */
        out: number | null;
    };
    /** Currently measured wind related data */
    wind: {
        /**
         * Currently measured wind speed in mph
         */
        current: number | null;
        /**
         * Currently measured average wind speed in mph
         */
        avg: number | null;
        /**
         * Currently measured wind direction. `direction.degrees` encodes it
         * in degrees, `direction.abbrevation` as string (`"N"`, `"S"`, ....).
         */
        direction: {
            /**
             * Currently measured wind direction in degrees (from `1` to `360`).
             * `90°` is East, `180°` is South, `270°`is West and `360°` is North.
             */
            degrees: number | null;
            /**
             * Currently measured wind direction encoded as string
             */
            abbrevation:
                | "NNE"
                | "NE"
                | "ENE"
                | "E"
                | "ESE"
                | "SE"
                | "SSE"
                | "S"
                | "SSW"
                | "SW"
                | "WSW"
                | "W"
                | "WNW"
                | "NW"
                | "NNW"
                | "N"
                | null;
        };
    };
    /**
     *  Curently measured rain related data
     */
    rain: {
        /**
         * The current rain rate in inch/hour
         */
        rate: number | null;
        /**
         * The last rainstorm's amount of rain
         */
        storm: number | null;
        /**
         * The last rainstorm's start date (without time)
         */
        stormStartDate: Date | null;
        /**
         * The amount of rain that fell today
         */
        day: number | null;
    };
    /**
     * Measured evapotranspiration (ET) of the day
     */
    et: number | null;
    /**
     * Currently measured UV index
     */
    uv: number | null;

    /**
     * Currently measured solar radiation in W/m²
     */
    solarRadiation: number | null;

    /**
     * The time the record was created
     */
    time: Date;
};
