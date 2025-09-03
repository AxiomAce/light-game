import { createMachine } from "xstate";
const machine = createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QDsCGBbMB5AZgOgEtkCAXA1AGwGUTUSwBiAUQDcxkSBtABgF1FQABwD2sUgWHIBIAB6IAjAHYAHHgBsagCzdNAJn0BONcrUBWRQBoQATwWLNebsoDMzxYoOaj+0wF9fVmiYuHgARgRQAASwtPTMbBw8-EggImJkktJyCEqqGtp6hsZmljYKus54pi7OyvKmBorOBnX+gRjY+OFRMXRgeL30kfLx7Fx80mnimSnZmmZ48tz13NyKukYa8la2CLrLVatra7rKypquzm0gQZ1hEdGx-YNgkbqjiRMpUxlSs4jzUyLZamVbrTZqbZlHKmeSOI7rCqeNTOeTKfwBG7CCBwaS3XCTUTTP6gbIAWjUO0QZIqeAM9IMaKURkZXnRmPx+CI4koND6hPSEhJsgBuipOQ26g0inkF30imMLmunPuPSeAuJWUQukUQOU+1OZ2OZyhuxRhzBim4GzO1U0mmVHRC3UefQGT2GGt+WoQzlp+utZ2Uxrq4vqikcLm0am4rk08jRjuCXQeL3dfTeXqFPuq3DwunM62Wftl3AMYYaVSj3BjcYT7P8QA */
  id: "nameOf",
  initial: "initialState",
  states: {
    initialState: {
      on: {
        Event: "big state",
      },
    },

    "big state": {
      states: {
        "state 1": {
          on: {
            Event: "state 1",
          },
        },

        "state 2": {
          on: {
            Event: "state 2",
          },
        },
      },

      initial: "state 2",

      on: {
        Event: "initialState",
      },
    },
  },
});
