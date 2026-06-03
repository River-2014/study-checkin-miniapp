Component({
  properties: {
    tabs: { type: Array, value: [] },
    active: { type: Number, value: 0 }
  },

  methods: {
    onTap: function(e) {
      var index = Number(e.currentTarget.dataset.index);
      if (index !== this.properties.active) {
        this.triggerEvent('change', { index: index });
      }
    }
  }
});
